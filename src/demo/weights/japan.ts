import { IPathSection } from "../../factory";

const weights: IPathSection[] = [
  {
    weight: 0,
    zoom: [1.2]
    // zoom: [1]
  },
  {
    weight: 8,
    // zoom: [1],
    zoom: [1.2, 1.4, 1.6, 2],
    icon: "/arrow.svg",
    iconZoom: [2, 1.5, 1, 1, 1, 1, 1, 0]
    // iconZoom: [1]
  },
  {
    weight: 2,
    // zoom: [1],
    icon: "/airplane.svg",
    zoom: [2, 3]
  },
  {
    weight: 2,
    zoom: [3],
    // zoom: [1],
    icon: "/airplane.svg"
  },
  {
    weight: 6,
    icon: "/airplane.svg",
    zoom: [3, 4]
    // zoom: [1]
  },
  {
    weight: 3,
    zoom: [4, 2],
    // zoom: [1],
    icon: "/airplane.svg"
  },
  {
    weight: 4,
    zoom: [2, 1.6, 1.4, 1.2],
    // zoom: [1],
    icon: "/airplane.svg",
    iconZoom: [1, 1.5, 2, 2, 2]
  }
];

export default weights;
