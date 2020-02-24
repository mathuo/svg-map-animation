export type CartesianCoordinate2d = { x: number; y: number };

const getPointAtLength = (path: SVGPathElement, length: number) => {
  const p = path.getPointAtLength(length);
  return { x: p.x, y: p.y } as CartesianCoordinate2d;
};

const getLength = (path: SVGPathElement) => path.getTotalLength();

function distance(
  pointA: CartesianCoordinate2d,
  pointB: CartesianCoordinate2d
) {
  const d = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
  return Math.sqrt(d.x * d.x + d.y * d.y);
}

export function getLengthAtPoint(
  path: SVGPathElement,
  point: CartesianCoordinate2d,
  subdivisionsPerIteration = 10,
  iterations = 5
) {
  let pathLength = getLength(path);

  const iterate = (lower: number, upper: number) => {
    const delta = upper - lower;
    const step = delta / (subdivisionsPerIteration - 1);

    const subdivisions = Array.from(Array(subdivisionsPerIteration))
      .map((v, i) => {
        const subLength = lower + step * i;
        const subPoint = getPointAtLength(path, subLength);
        const subDistance = distance(point, subPoint);
        return {
          length: subLength,
          point: subPoint,
          distance: subDistance
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .map(v => v.length)
      .slice(0, 2);

    if (!--iterations) return subdivisions[0];

    const result = subdivisions.sort((a, b) => a - b);

    return iterate(result[0], result[1]);
  };

  return iterate(0, pathLength);
}

export function lerp(v0: number, v1: number, t: number) {
  return v0 * (1 - t) + v1 * t;
}

export const clamp = (min: number, max: number) => (value: number) =>
  Math.max(Math.min(value, max), min);
