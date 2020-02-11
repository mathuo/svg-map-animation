import { getLengthAtPoint, lerp } from "./math";

export interface IPathSection {
  zoom?: number[];
  weight: number;
  icon?: string;
  iconZoom?: number[];
}

interface IPathSectionInternal extends IPathSection {
  normalizedWeight: number;
}

export class Factory {
  private transformMatrix: number[];
  private viewbox: any[];
  private matrixGroup: SVGElement;
  private trailPath: SVGPathElement;
  private trailPathLength: number;
  private cameraPath: SVGPathElement;
  private cameraPathLength: number;
  private points: any[];
  private scale: number;
  private x: number;
  private y: number;
  private sections: IPathSectionInternal[];
  private icons: HTMLImageElement[];
  private activeIconIndex = -1;
  private previousPosition: { x: number; y: number };
  private previousPercentage: number;
  // private container: HTMLElement;

  public static TRANSFORM_MATRIX = [1, 0, 0, 1, 0, 0];

  constructor(
    private readonly container: HTMLElement,
    private readonly svg: any,
    weights: IPathSection[],
    private readonly disableCameraPath = false
  ) {
    this.transformMatrix = [...Factory.TRANSFORM_MATRIX];
    // this.viewbox = svg.getAttributeNS(null, "viewBox").split(" ");
    this.matrixGroup = svg.getElementById("matrix-group");

    this.trailPath = svg.querySelector("#trail-path path");

    if (!this.trailPath) {
      throw new Error("#trail-path path is missing");
    }

    this.trailPathLength = this.trailPath.getTotalLength();

    if (!this.disableCameraPath) {
      this.cameraPath = svg.querySelector("#camera-path path");
      this.cameraPathLength =
        this.cameraPath && this.cameraPath.getTotalLength();
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

  redraw(kvargs) {
    const { scale, x, y } = kvargs;

    if (scale !== undefined) {
      this.scale = scale;
      for (let i = 0; i < 4; i++) {
        this.transformMatrix[i] = Factory.TRANSFORM_MATRIX[i] * this.scale;
      }
    }

    if (x !== undefined) {
      this.x = x;
    }

    if (y !== undefined) {
      this.y = y;
    }

    this.transformMatrix[4] = (1 - this.scale) * this.x;
    this.transformMatrix[5] = (1 - this.scale) * this.y;

    const newMatrix = "matrix(" + this.transformMatrix.join(" ") + ")";
    this.matrixGroup.setAttributeNS(null, "transform", newMatrix);
  }

  airplane = undefined;

  moveTrailPathToPercentage(percentage) {
    let normPerc = percentage;
    let scale: number = 1;
    let pos: { x: number; y: number };

    let cameraPoint = this.cameraPath && this.getPointOnCameraPath(normPerc);

    if (this.sections) {
      let total = 0;
      let j = 0;
      let k = 0;
      for (let i = 0; i < this.sections.length; i++) {
        const next = total + this.sections[i].normalizedWeight;
        if (next >= percentage) {
          k = (percentage - total) / this.sections[i].normalizedWeight;
          break;
        }
        j = i;
        total = next;
      }

      normPerc =
        this.points[j].pos + k * (this.points[j + 1].pos - this.points[j].pos);
      pos = this.getPointOnTrailPath(normPerc);
      cameraPoint = this.cameraPath && this.getPointOnCameraPath(normPerc);

      const s = this.sections[j + 1];
      if (s.zoom) {
        const items = s.zoom;
        const before = Math.floor(Math.max(items.length - 1, 0) * k);
        if (before === items.length - 1) {
          scale = items[items.length - 1];
        } else {
          const t = (items.length - 1) * k - before;
          const x0 = items[before];
          const x1 = items[before + 1];
          scale = x0 > x1 ? lerp(x0, x1, t) : lerp(x1, x0, 1 - t);
        }
      }

      if (s.icon) {
        if (
          this.activeIconIndex > 0 &&
          this.activeIconIndex !== j + 1 &&
          this.container.contains(this.icons[this.activeIconIndex])
        ) {
          this.container.removeChild(this.icons[this.activeIconIndex]);
        }

        // container.appendChild(this.icons[j + 1]);
        this.activeIconIndex = j + 1;

        const icon = this.icons[j + 1];

        const current = {
          x: pos.x - icon.width / 2,
          y: pos.y - icon.height / 2
        };
        const previous = this.previousPosition
          ? {
              x: this.previousPosition.x - icon.width / 2,
              y: this.previousPosition.y - icon.height / 2
            }
          : pos;

        const isForward = this.previousPercentage < normPerc;
        let angle = Math.atan2(
          isForward ? previous.x - current.x : current.x - previous.x,
          isForward ? previous.y - current.y : current.y - previous.y
        );

        let iconScale = 1;

        if (s.iconZoom) {
          const items = s.iconZoom;
          const before = Math.floor(Math.max(items.length - 1, 0) * k);
          if (before === items.length - 1) {
            iconScale = items[items.length - 1];
          } else {
            const t = (items.length - 1) * k - before;
            const x0 = items[before];
            const x1 = items[before + 1];
            iconScale = x0 > x1 ? lerp(x0, x1, t) : lerp(x1, x0, 1 - t);
          }
        }

        if (!this.airplane && s.icon) {
          this.airplane = this.getAirplane();
          this.matrixGroup.insertBefore(
            this.airplane,
            this.svg.getElementById("trail-path")
          );
        } else if (this.airplane && s.icon) {
          // this.airplane = this.svg.getElementById("airplane");
        }

        if (cameraPoint) {
          const dim = this.airplane.getBoundingClientRect();

          const viewBox = this.svg
            .getAttribute("viewBox")
            .split(" ")
            .map(Number.parseFloat);
          const vbWidth = viewBox[2];
          const vbHeight = viewBox[3];

          const {
            width: elWidth,
            height: elHeight
          } = this.svg.getBoundingClientRect();

          const aspectXScale = elWidth / vbWidth;
          const aspectYScale = elHeight / vbHeight;

          const x = pos.x - dim.width / (2 * aspectXScale * this.scale);
          const y = pos.y - dim.height / (2 * aspectYScale * this.scale);

          const el = this.svg.querySelector("#airplane path");
          el.setAttribute(
            "transform",
            `translate(${x}, ${y}) scale(${iconScale}) 
            rotate(${(-180 * angle) / Math.PI}, 12,12)`
          );
        } else {
          const dim = this.airplane.getBoundingClientRect();

          this.airplane.setAttribute("x", pos.x - dim.width / 2);
          this.airplane.setAttribute("y", pos.y - dim.height / 2);

          const el = this.airplane.getElementById("airplane-path");
          el.setAttribute(
            "transform",
            `scale(${iconScale}) rotate(${(-180 * angle) / Math.PI},12,12)`
          );
        }
      } else {
        if (this.airplane) {
          this.airplane.remove();
          this.airplane = undefined;
        }

        if (
          this.activeIconIndex > 0 &&
          this.container.contains(this.icons[this.activeIconIndex])
        ) {
          this.container.removeChild(this.icons[this.activeIconIndex]);
          this.activeIconIndex = -1;
        }
      }
    } else {
      pos = this.getPointOnTrailPath(normPerc);
    }

    if (this.cameraPath) {
      const p = this.cameraPathLength * normPerc + " " + this.cameraPathLength;
      this.cameraPath.setAttribute("stroke-dasharray", p);

      this.redraw({ x: cameraPoint.x, y: cameraPoint.y, scale });
    } else {
      this.redraw({ x: pos.x, y: pos.y, scale });
    }

    this.previousPosition = pos;
    this.previousPercentage = normPerc;

    const portion =
      this.trailPathLength * normPerc + " " + this.trailPathLength;
    this.trailPath.setAttribute("stroke-dasharray", portion);

    this.points.forEach(x => {
      if (x.pos > normPerc) {
        x.off();
      } else {
        x.on();
      }
    });
  }

  getPointOnTrailPath(percentage) {
    return this.trailPath.getPointAtLength(this.trailPathLength * percentage);
  }

  getPointOnCameraPath(percentage) {
    return this.cameraPath.getPointAtLength(this.cameraPathLength * percentage);
  }

  getAirplane() {
    const g1 = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g1.id = "airplane";
    const g2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    g2.id = "airplane-path";
    g2.setAttribute(
      "d",
      "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
    );
    g2.setAttribute("fill", "#000");
    g1.appendChild(g2);
    return g1;
  }
}
