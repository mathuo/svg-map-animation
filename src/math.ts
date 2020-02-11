function getPointAtLength(path, length) {
    let p = path.getPointAtLength(length);
    return { x: p.x, y: p.y };
  }
  
  function getLength(path) {
    return path.getTotalLength();
  }
  
  function distance(pointA, pointB) {
    // let d = sub(pointA, pointB);
    let d = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
    return Math.sqrt(d.x * d.x + d.y * d.y);
  }
  
  export function getLengthAtPoint(
    path,
    point,
    subdivisionsPerIteration = 10,
    iterations = 5
  ) {
    let pathLength = getLength(path);
  
    return (function iterate(lower, upper) {
      let delta = upper - lower;
      let step = delta / (subdivisionsPerIteration - 1);
  
      let subdivisions = Array.from(Array(subdivisionsPerIteration))
        .map((v, i) => {
          let subLength = lower + step * i;
          let subPoint = getPointAtLength(path, subLength);
          let subDistance = distance(point, subPoint);
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
    })(0, pathLength);
  }
  
  export function lerp(v0: number, v1: number, t: number) {
    return v0 * (1 - t) + v1 * t;
  }
  