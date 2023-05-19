import React, { useState } from "react";
import Navbar from "./navbar/Navbar";
import Content from "./content/Content";

function App() {
  const [sudoData, setSudoData] = useState({
    title:
      "ABS - Jobs In Australia - Employee Jobs and Income by Industry (SA2) 2018-19",
    valid: true,
    map: "median_income_sa2",
    bar: "median_income_sa2_bar",
    heatmap: "",
  }); // State to store the data for the SUDO graph
  const [twitterData, setTwitterData] = useState({
    title: "Twitter Sentimental Summary Data from 2022-02 to 2022-07",
    valid: true,
    map: "twitter_vic_sal_2022_02_2022_07",
  });
  const [mastodonData, setMastodonData] = useState("Mastodon Data"); // State to store the data for the Twitter graph

  return (
    <>
      <div className="w-full">
        <Navbar setSudoData={setSudoData} />
      </div>

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
