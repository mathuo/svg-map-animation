import { getLengthAtPoint, lerp, Point } from "./math";

export interface IPathSection {
  zoom?: number[];
  weight: number;
  icon?: string;
  iconZoom?: number[];
}

interface IPathSectionInternal extends IPathSection {
  normalizedWeight: number;
}

interface IPoint {
  pos: number;
  length: number;
  on: () => void;
  off: () => void;
}

export class Factory {
  private matrixGroup: HTMLElement;
  private trailPath: SVGPathElement;
  private trailPathLength: number;
  private cameraPath: SVGPathElement;
  private cameraPathLength: number;
  private points: IPoint[];
  private scale: number;
  private x: number;
  private y: number;
  private sections: IPathSectionInternal[];
  private icons: HTMLImageElement[];
  private activeIconIndex = -1;
  private previousPosition: Point;
  private previousPercentage: number;
  private activeIcon = undefined;

  constructor(
    private readonly container: HTMLElement,
    private readonly svg: SVGElement & Pick<Document, "getElementById">, // not sure where getElementById comes from but it's there
    weights: IPathSection[],
    private readonly disableCameraPath = false
  ) {
    this.matrixGroup = svg.getElementById("matrix-group");
    this.trailPath = svg.querySelector("#trail-path path");

    if (!this.trailPath) {
      throw new Error("#trail-path path is missing");
    }

    // const i = this.getIcon("./airplane.svg");
    // let d = 0;
    // this.matrixGroup.appendChild(i);
    // setInterval(() => {
    //   i.setAttribute("transform", `translate(0 0) rotate(${d++} 10 10)`);
    // }, 10);

    this.trailPathLength = this.trailPath.getTotalLength();

    if (!this.disableCameraPath) {
      this.cameraPath = svg.querySelector("#camera-path path");
      this.cameraPathLength = this.cameraPath?.getTotalLength();
    }

    this.icons = weights.map(x => {
      if (x.icon) {
        const img = document.createElement("img");
        img.setAttribute("src", x.icon);
        img.style.position = "absolute";
        return img;
      }
      return undefined;
    });

    if (weights) {
      const sum = weights.reduce((x, y) => x + y.weight, 0);
      this.sections = weights.map(x => ({
        ...x,
        normalizedWeight: x.weight / sum
      }));
    }

    const { x, y } = this.trailPath.getPointAtLength(0);

    this.points = [];
    const points = svg.querySelectorAll("#locations circle");
    for (const point of points) {
      const { cx, cy } = {
        cx: parseFloat(point.getAttribute("cx")),
        cy: parseFloat(point.getAttribute("cy"))
      };
      const length = getLengthAtPoint(this.trailPath, { x: cx, y: cy });

      const obj = {
        pos: length / this.trailPathLength,
        length,
        on: () => point.setAttribute("fill", "red"),
        off: () => point.setAttribute("fill", "blue")
      };

      this.points.push(obj);
    }

    this.points = this.points.sort((a, b) => a.pos - b.pos);

    if (this.sections && this.sections.length !== this.points.length) {
      throw new Error("sections.lenth !== points.length");
    }

    this.redraw({ x, y });
  }

  public redraw(kvargs: { scale?: number; x?: number; y?: number }) {
    const { scale, x, y } = kvargs;

    if (scale !== undefined) {
      this.scale = scale;
    }

    if (x !== undefined) {
      this.x = x;
    }

    if (y !== undefined) {
      this.y = y;
    }

    const { width: w, height: h } = this.getViewBoxDimensions();

    // unit transform matrix is [1, 0, 0, 1, 0, 0]
    const transform = `matrix(${this.scale} 0 0 ${this.scale} ${Math.min(
      0,
      w / 2 - this.x
    ) +
      (1 - this.scale) * this.x} ${Math.min(0, h / 2 - this.y) +
      (1 - this.scale) * this.y})`;

    this.matrixGroup.setAttribute("transform", transform);
  }

  public moveTrailPathToPercentage(percentage: number) {
    const hasCameraPath = !!this.cameraPath;
    let normPerc = percentage;
    let pageScale: number = 1;
    let trailPoint: { x: number; y: number };

    let cameraPoint: DOMPoint;

    if (this.sections) {
      let total = 0;
      let sectionIndex = 0;
      let sectionPercentageProgress = 0;
      for (let i = 0; i < this.sections.length; i++) {
        const next = total + this.sections[i].normalizedWeight;
        if (next >= percentage) {
          sectionPercentageProgress =
            this.sections[i].normalizedWeight === 0
              ? 0
              : (percentage - total) / this.sections[i].normalizedWeight;
          break;
        }
        sectionIndex = i;
        total = next;
      }

      normPerc =
        this.points[sectionIndex].pos +
        sectionPercentageProgress *
          (this.points[sectionIndex + 1].pos - this.points[sectionIndex].pos);
      trailPoint = this.getPointOnTrailPath(normPerc);
      cameraPoint = this.getPointOnCameraPath(normPerc);

      const section = this.sections[sectionIndex + 1];
      pageScale = this.getPageZoom(section, sectionPercentageProgress);

      if (section.icon) {
        const iconScale = this.getIconScale(section, sectionPercentageProgress);
        const isIconStale =
          this.activeIconIndex > 0 && this.activeIconIndex !== sectionIndex + 1;

        if (isIconStale) {
          this.activeIcon.remove();
          this.activeIcon = undefined;
          this.activeIconIndex = -1;
        }

        if (!this.activeIcon) {
          this.activeIconIndex = sectionIndex + 1;
          this.activeIcon = this.getIcon(section.icon);
          this.matrixGroup.insertBefore(
            this.activeIcon,
            this.svg.getElementById("trail-path")
          );
        }

        const icon = this.icons[this.activeIconIndex];
        const { height: iconHeight, width: iconWidth } = icon;

        const currentPoint: Point = {
          x: trailPoint.x - iconWidth / 2,
          y: trailPoint.y - iconHeight / 2
        };
        const previousPoint: Point = this.previousPosition
          ? {
              x: this.previousPosition.x - iconWidth / 2,
              y: this.previousPosition.y - iconHeight / 2
            }
          : currentPoint;

        const isIncreasing = normPerc > this.previousPercentage;
        const iconAngleAsRadians = -Math.atan2(
          isIncreasing
            ? previousPoint.x - currentPoint.x
            : currentPoint.x - previousPoint.x,
          isIncreasing
            ? previousPoint.y - currentPoint.y
            : currentPoint.y - previousPoint.y
        );

        const point = hasCameraPath ? currentPoint : trailPoint;

        const el = this.svg.querySelector("#trail-icon");

        el.setAttribute(
          "transform",
          // `translate(${point.x} ${point.y}) rotate(${(iconAngleAsRadians * 180) / Math.PI} ${iconWidth/2} ${iconHeight/2}) scale(${iconScale}) `
          this.getTransformMatrix(
            point.x,
            point.y,
            iconWidth / 2,
            iconHeight / 2,
            iconScale,
            iconScale,
            iconAngleAsRadians
          )
        );
      } else if (this.activeIcon) {
        this.activeIcon.remove();
        this.activeIcon = undefined;
        this.activeIconIndex = -1;
      }
    } else {
      trailPoint = this.getPointOnTrailPath(normPerc);
      cameraPoint = this.getPointOnCameraPath(normPerc);
    }

    if (hasCameraPath) {
      const cameraPathStroke =
        this.cameraPathLength * normPerc + " " + this.cameraPathLength;
      this.cameraPath.setAttribute("stroke-dasharray", cameraPathStroke); //stroke-width for width

      this.redraw({ x: cameraPoint.x, y: cameraPoint.y, scale: pageScale });
    } else {
      this.redraw({ x: trailPoint.x, y: trailPoint.y, scale: pageScale });
    }

    const trailPathStroke =
      this.trailPathLength * normPerc + " " + this.trailPathLength;
    this.trailPath.setAttribute("stroke-dasharray", trailPathStroke); //stroke-width for width

    this.points.forEach(x => {
      if (x.pos > normPerc) {
        x.off();
      } else {
        x.on();
      }
    });

    this.previousPosition = trailPoint;
    this.previousPercentage = normPerc;
  }

  private getTransformMatrix(
    dx: number,
    dy: number,
    cx: number,
    cy: number,
    sx: number,
    sy: number,
    angle: number
  ) {
    // (sx × cos(a),
    // sy × sin(a),
    // -sx × sin(a),
    // sy × cos(a),
    // (-cx × cos(a) + cy × sin(a) + cx) × sx + tx + cx x (1 - sx),
    // (-cx × sin(a) - cy × cos(a) + cy) × sy + ty + cy x (1 - sy))

    return `matrix(
        ${sx * Math.cos(angle)} 
        ${sy * Math.sin(angle)}
        ${-sx * Math.sin(angle)} 
        ${sy * Math.cos(angle)} 
        ${(-cx * Math.cos(angle) + cy * Math.sin(angle) + cx) * sx +
          dx +
          cx * (1 - sx)} 
        ${(-cx * Math.sin(angle) - cy * Math.cos(angle) + cy) * sy +
          dy +
          cy * (1 - sy)})`;
  }

  private getIconScale(s: IPathSectionInternal, k: number) {
    return this.getZoom(s?.iconZoom, k);
  }

  private getPageZoom(s: IPathSectionInternal, k: number) {
    return this.getZoom(s?.zoom, k);
  }

  private getZoom(items: number[], k: number) {
    if (!items) {
      return 1;
    }

    const before = Math.floor(Math.max(items.length - 1, 0) * k);
    if (before === items.length - 1) {
      return items[items.length - 1];
    } else {
      const t = (items.length - 1) * k - before;
      const x0 = items[before];
      const x1 = items[before + 1];
      return x0 > x1 ? lerp(x0, x1, t) : lerp(x1, x0, 1 - t);
    }
  }

  private getViewBoxDimensions() {
    const viewbox = this.svg.getAttribute("viewBox").split(/\s+|,/);
    return { height: Number(viewbox[3]), width: Number(viewbox[2]) };
  }

  private getPointOnTrailPath(percentage: number) {
    return this.trailPath.getPointAtLength(this.trailPathLength * percentage);
  }

  private getPointOnCameraPath(percentage: number) {
    return this.cameraPath?.getPointAtLength(
      this.cameraPathLength * percentage
    );
  }

  private getIcon(url: string) {
    const image = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "image"
    );
    image.setAttribute("href", url);
    image.id = "trail-icon";
    return image;
  }
}
