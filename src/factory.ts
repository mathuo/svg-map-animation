import { getLengthAtPoint, lerp, CartesianCoordinate2d, clamp } from "./math";

export type PathSection = {
  zoom?: number[];
  weight: number;
  icon?: string;
  iconZoom?: number[];
};

type PathSectionInternal = PathSection & {
  normalizedWeight: number;
};

type PathPoint = {
  pos: number;
  length: number;
  on: () => void;
  off: () => void;
};

const Consts = {
  CameraPath: "camera-path",
  TrailPath: "trail-path",
  Locations: "locations",
  TrailIcon: "trail-icon",
  Group: "canvas"
};

export interface IFactory {
  redraw: (kvargs: { scale?: number; x?: number; y?: number }) => void;
  moveTrailPathToPercentage: (percentage: number) => void;
}

export interface IFactoryOptions {
  disableCameraPath?: boolean;
  fixedZoom?: number;
}

export class Factory implements IFactory {
  private container: SVGGraphicsElement;
  //
  private trailPath: SVGPathElement;
  private trailPathLength: number;
  //
  private cameraPath: SVGPathElement;
  private cameraPathLength: number;
  //
  private sections: PathSectionInternal[];
  private points: PathPoint[];
  //
  private x: number;
  private y: number;
  private scale: number;
  //
  private activeIconIndex = -1;
  private activeIcon: SVGImageElement;
  //
  private previousPosition: CartesianCoordinate2d;
  private previousPercentage: number;

  constructor(
    private readonly svg: SVGGraphicsElement,
    weights: PathSection[],
    private readonly options?: IFactoryOptions
  ) {
    this.container = svg.querySelector(`#${Consts.Group}`);
    this.trailPath = svg.querySelector(`#${Consts.TrailPath} path`);

    if (!this.trailPath) {
      throw new Error(`#${Consts.TrailPath} path is missing`);
    }

    this.trailPathLength = this.trailPath.getTotalLength();

    if (!this?.options?.disableCameraPath) {
      this.cameraPath = svg.querySelector(`#${Consts.CameraPath} path`);
      this.cameraPathLength = this.cameraPath?.getTotalLength();
    }

    if (weights) {
      this.sections = this.createSections(weights);
    }

    this.points = this.createPoints();

    if (this.sections && this.sections.length !== this.points.length) {
      throw new Error("sections.lenth !== points.length");
    }

    const { x, y } = this.trailPath.getPointAtLength(0);
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

    const { width: w, height: h } = this.getViewBoxDimensions(); // visible view height in pixels

    const { width: svgW, height: svgH } = this.container.getBBox();

    let dx = Math.min(0, w / 2 - this.x) + (1 - this.scale) * this.x;
    let dy = Math.min(0, h / 2 - this.y) + (1 - this.scale) * this.y;

    const { width, height } = this.svg.getBBox(); // max height, width

    const remainingBottom = height - svgH * this.scale;

    dx = Math.max(-width + w, dx);
    //TODO I haven't quite worked out why I need +remiainingBottom, but I do need it...
    dy = Math.max(-height + h + remainingBottom, dy);

    // unit transform matrix is [1, 0, 0, 1, 0, 0]
    const transform = `matrix(${this.scale} 0 0 ${this.scale} ${dx} ${dy})`;

    this.container.setAttribute("transform", transform);
  }

  public moveTrailPathToPercentage(percentage: number) {
    const hasCameraPath = !!this.cameraPath;
    let normPerc = percentage;
    let pageScale: number = 1;
    let trailPoint: { x: number; y: number };

    let cameraPoint: DOMPoint;

    if (this.sections) {
      const {
        sectionIndex,
        sectionPercentageProgress
      } = this.getSectionMetadata(percentage);

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
          this.container.insertBefore(
            this.activeIcon,
            this.svg.querySelector(`#${Consts.TrailPath}`)
          );
        }

        const el = this.svg.querySelector(
          `#${Consts.TrailIcon}`
        ) as SVGGraphicsElement;
        const { height: iconHeight, width: iconWidth } = el.getBBox();

        const currentPoint: CartesianCoordinate2d = {
          x: trailPoint.x - iconWidth / 2,
          y: trailPoint.y - iconHeight / 2
        };
        const previousPoint: CartesianCoordinate2d = this.previousPosition
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

        el.setAttribute(
          "transform",
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

  private getSectionMetadata(percentage: number) {
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
    return { sectionIndex, sectionPercentageProgress };
  }

  private getTransformMatrix(
    dx: number,
    dy: number,
    cx: number,
    cy: number,
    sx: number,
    sy: number,
    radians: number
  ) {
    // matrix transform encompasing a translation, rotatation about center and scaling about center
    //
    // (sx × cos(a),
    // sy × sin(a),
    // -sx × sin(a),
    // sy × cos(a),
    // (-cx × cos(a) + cy × sin(a) + cx) × sx + tx + cx x (1 - sx),
    // (-cx × sin(a) - cy × cos(a) + cy) × sy + ty + cy x (1 - sy))

    return `matrix(
        ${sx * Math.cos(radians)} 
        ${sy * Math.sin(radians)}
        ${-sx * Math.sin(radians)} 
        ${sy * Math.cos(radians)} 
        ${(-cx * Math.cos(radians) + cy * Math.sin(radians) + cx) * sx +
          dx +
          cx * (1 - sx)} 
        ${(-cx * Math.sin(radians) - cy * Math.cos(radians) + cy) * sy +
          dy +
          cy * (1 - sy)})`;
  }

  private getIconScale(s: PathSectionInternal, k: number) {
    return this.getZoom(s?.iconZoom, k);
  }

  private getPageZoom(s: PathSectionInternal, k: number) {
    if (typeof this.options?.fixedZoom === "number") {
      return this.options?.fixedZoom;
    }
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
    image.id = Consts.TrailIcon;
    return image;
  }

  private createSections(weights: PathSection[]) {
    const sum = weights.reduce((x, y) => x + y.weight, 0);
    return weights.map(x => ({
      ...x,
      normalizedWeight: x.weight / sum
    }));
  }

  private createPoints() {
    const points = [];
    const svgPoints = this.svg.querySelectorAll(`#${Consts.Locations} circle`);
    for (const point of svgPoints) {
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

      points.push(obj);
    }

    return points.sort((a, b) => a.pos - b.pos);
  }
}
