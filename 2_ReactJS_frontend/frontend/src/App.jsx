import React from "react";
import Navbar from "./navbar/Navbar";
import Content from "./content/Content";
import Detail from "./detailed/Detail";

function App() {
  return (
    <div className="min-w-screen flex flex-col items-center ">
      <Navbar />
      {/* <br />
      <Title /> */}
      <br />
      <Content />

      <br />
      <Detail />

      <br />
    </div>
  );
}

export default App;
