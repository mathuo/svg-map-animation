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
  },
  russia: {
    file: "./russia.svg",
    weights: require("./weights/russia").default
  }
};

const optionlist = Object.keys(options);

const App = () => {
  const [option, setOption] = React.useState<string>(optionlist[2]);
  const [speed, setSpeed] = React.useState<number>(0.5);
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

  React.useEffect(() => {
    const cb = (ev: WheelEvent) => {
      const increment = (ev as any).wheelDeltaY < 0;
      setRange(n => clamp(0, 100)(increment ? n + speed : n - speed));
    };
    window.addEventListener("mousewheel", cb);

    return () => {
      window.removeEventListener("mousewheel", cb);
    };
  });

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
      factory.current.dispose();
      factory.current = undefined;
      return;
    }
    if (!svgDocument) {
      return;
    }

    factory.current = new Factory(svgDocument as any, options[option].weights, {
      // disableAspectRatio: true,
      fixedZoom: 1
    });
    factory.current.moveTrailPathToPercentage(range / 100);
  }, [svgDocument, option]);

  const onChangeDropdown = (ev: React.ChangeEvent<HTMLSelectElement>) => {
    setOption(ev.target.value);
  };

  const onSpeedChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const s = Number(ev.target.value);

    if (Number.isNaN(s)) {
      return;
    }
    setSpeed(s);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "10px",
          marginBottom: "10px",
          // backgroundColor: "lightgreen",
          display: " flex"
        }}
        className="header"
      >
        <select value={option} onChange={onChangeDropdown}>
          {optionlist.map((o, i) => (
            <option key={i}>{o}</option>
          ))}
        </select>
        <label>
          Speed:
          <input
            value={speed}
            step={0.1}
            min={0}
            max={99}
            onChange={onSpeedChange}
            type="number"
          />
        </label>
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
        <object
          style={{ height: "80vh" }}
          ref={refCb}
          data={options[option].file}
        />
      </div>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("app"));
