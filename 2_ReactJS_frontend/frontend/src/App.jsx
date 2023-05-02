import React from "react";
import Navbar from "./navbar/Navbar";
import Content from "./content/Content";
import Detail from "./detailed/Detail";

function App() {
  return (
    <>
      <Navbar />

      <br />
      <div className="min-w-screen flex flex-col items-center ">
        <Content />

        <br />
        <Detail />

        <br />
      </div>
    </>
  );
}

export default App;
