import React, { useState } from "react";
import Navbar from "./navbar/Navbar";
import Content from "./content/Content";

function App() {
  const [sudoData, setSudoData] = useState({
    title:
      "ABS - Jobs In Australia - Employee Jobs and Income by Industry (SA2) 2018-19",
    valid: true,
    map: "median_income_sa2",
  }); // State to store the data for the SUDO graph
  const [twitterData, setTwitterData] = useState("Twitter Data"); // State to store the data for the Twitter graph
  const [mastodonData, setMastodonData] = useState("Mastodon Data"); // State to store the data for the Twitter graph

  return (
    <>
      <Navbar setSudoData={setSudoData} />

      <br />
      <div className="min-w-screen flex flex-col items-center ">
        <Content
          sudoData={sudoData}
          setSudoData={setSudoData}
          twitterData={twitterData}
          setTwitterData={setTwitterData}
          mastodonData={mastodonData}
          setMastodonData={setMastodonData}
        />
      </div>
    </>
  );
}

export default App;
