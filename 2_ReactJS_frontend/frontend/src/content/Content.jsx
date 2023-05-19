import React from "react";
import SudoPlot from "../graphs/sudo";
import TwitterPlot from "../graphs/twitter";
import SummarisedContent from "./ContentSelection";

export default function Content({
  sudoData,
  setSudoData,
  twitterData,
  setTwitterData,
  mastodonData,
  setMastodonData,
}) {
  const navbarHeight = 75; // Set the height of the navbar in pixels

  const contentHeight = `calc(100vh - ${navbarHeight}px)`; // Calculate the remaining height after subtracting the navbar height

  return (
    <div
      className="h-screen min-w-screen max-w-screen grid grid-cols-5 gap-3 pt-12 pb-4"
      style={{ height: contentHeight }}
    >
      <div className="col-span-2 h-full rounded-md overflow-y-auto scrollbar-hide">
        <SummarisedContent
          sudoData={sudoData}
          twitterData={twitterData}
          mastodonData={mastodonData}
        />
      </div>

      <div
        className="col-span-3 h-full rounded-md grid grid-cols-1 gap-3 overflow-y-auto scrollbar-hide"
        id="plotContainer"
      >
        <TwitterPlot
          twitterData={twitterData}
          setTwitterData={setTwitterData}
        />
        <SudoPlot sudoData={sudoData} setSudoData={setSudoData} />
      </div>
    </div>
  );
}
