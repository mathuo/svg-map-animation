import * as React from "react";
import * as ReactDOM from "react-dom";
import { IPathSection, Factory } from "./factory";

const weights: IPathSection[] = [
  {
    weight: 0,
    zoom: [1.2]
  },
  {
    weight: 8,
    zoom: [1.2, 1.4, 1.6, 2],
    icon: "/src/airplane.svg",
    iconZoom: [2, 1.5, 1, 1, 1, 1, 1, 0]
  },
  {
    weight: 2,
    zoom: [2, 3]
  },
  {
    weight: 2,
    zoom: [3]
  },
  {
    weight: 6,
    zoom: [3, 4]
  },
  {
    weight: 3,
    zoom: [4, 2]
  },
  {
    weight: 4,
    zoom: [2, 1.6, 1.4, 1.2],
    icon: "/src/airplane.svg",
    iconZoom: [1, 1.5, 2, 2, 2]
  }
];

const App = () => {
  const factory = React.useRef<Factory>();
  const [svgDocument, setSvgDocument] = React.useState<HTMLElement>();
  const [range, setRange] = React.useState<number>(0);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(event.target.value);
    if (Number.isNaN(n)) {
      return;
    }
    setRange(n);
  };

  const refCb = (ref: HTMLObjectElement) => {
    if (!ref) {
      return;
    }
    setSvgDocument(ref.contentDocument.getElementById("svg-el"));
  };

  React.useEffect(() => {
    if (!factory.current) {
      return;
    }

    factory.current.moveTrailPathToPercentage(range / 100);
  }, [range]);

  React.useEffect(() => {
    if (factory.current) {
      return;
    }
    if (!svgDocument) {
      return;
    }

    factory.current = new Factory(
      document.getElementById("map-container"),
      svgDocument,
      weights
    );
  }, [svgDocument]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "10px",
          backgroundColor: "lightgreen"
        }}
      >
        <input
          style={{ width: "100%" }}
          onChange={onChange}
          type="range"
          name="points"
          min="0"
          max="100"
          step="0.1"
          value={range}
        />
      </div>
      <div id="map-container">
        <object ref={refCb} data="japan.svg" />
      </div>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("app"));
