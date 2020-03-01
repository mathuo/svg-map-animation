import * as React from "react";
import * as ReactDOM from "react-dom";
import { IFactory, Factory } from "../factory";
import { clamp } from "../math";

const options = {
  trainline: {
    file: "./trainline.svg",
    weights: require("./weights/trainline").default
  },
  japan: {
    file: "./japan.svg",
    weights: require("./weights/japan").default
  }
};

const currentOptions = options.japan;

const App = () => {
  const factory = React.useRef<IFactory>();
  const [svgDocument, setSvgDocument] = React.useState<HTMLElement>();
  const [range, setRange] = React.useState<number>(0);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(event.target.value);
    if (Number.isNaN(n)) {
      return;
    }
    setRange(clamp(0, 100)(n));
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

    factory.current = new Factory(svgDocument as any, currentOptions.weights, {
      // fixedZoom: 4
    });
  }, [svgDocument]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "10px",
          marginBottom: "10px",
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
        <object ref={refCb} data={currentOptions.file} />
      </div>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("app"));
