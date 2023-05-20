import React from "react";
import { Card, CardContent, Typography } from "@mui/material";
import { BsTwitter, BsMastodon } from "react-icons/bs";

import SudoContent from "./sudoCard";
import MastodonContent from "./mastodonCard";
import TwitterContent from "./twitterCard";

const minHeight = 370;

function SummarisedContent({ sudoData, twitterData, mastodonData }) {
  return (
    <div className="flex flex-col h-auto gap-4 overflow-y-auto">
      <TwitterContent twitterData={twitterData} ContentHeader={ContentHeader} />
      <MastodonContent
        mastodonData={mastodonData}
        ContentHeader={ContentHeader}
      />
      <SudoContent
        sudoData={sudoData}
        minHeight={minHeight}
        ContentHeader={ContentHeader}
      />
    </div>
  );
}

export default SummarisedContent;

function ContentHeader({ string, children }) {
  // console.log(string);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {children}
      <Typography variant="h6" component="div" color="#094183">
        {string
          ? `${string.split(" - ")[0]} ${
              string.split(" - ")[1] ? string.split(" - ")[1] : ""
            }`
          : ""}
      </Typography>
    </div>
  );
}
