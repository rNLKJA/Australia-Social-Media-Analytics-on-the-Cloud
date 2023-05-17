import React from "react";

import Twitter from "./TwitterDropdown";
import Mastodon from "./MastodonDropdown";
import Sudo from "./SUDODropdown";
import GPTPopUp from "./GPTPopUp";

const logo = require("./unimelb.png");

const Navbar = ({
  sudoData,
  setSudoData,
  twitterData,
  setTwitterData,
  mastodonData,
  setMastodonData,
}) => {
  return (
    <nav
      className="flex w-screen justify-center items-center fixed z-10 top-0"
      style={{ backgroundColor: "white" }}
    >
      <div className="container min-w-full mx-auto flex flex-row items-center justify-between py-2  pl-10 pr-10">
        <div className="flex flex-row items-center text-center text-black">
          <img src={logo} alt="unimelb logo" className="h-8 mr-3" />
          <h1 className="font-bold" style={{ fontSize: "24px" }}>
            Team 57 Social Sense Dashboard
          </h1>
        </div>

        <div className="flex items-center justify-center gap-5">
          <Mastodon
            mastodonData={mastodonData}
            setMastodonData={setMastodonData}
          />
          <Twitter twitterData={twitterData} setTwitterData={setTwitterData} />
          <Sudo sudoData={sudoData} setSudoData={setSudoData} />
          {/* <GPTPopUp /> */}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
