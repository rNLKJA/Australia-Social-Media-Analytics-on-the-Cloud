import React from "react";
import { Card, CardContent, Typography } from "@mui/material";
import { BsTwitter, BsMastodon } from "react-icons/bs";

import SudoContent from "./sudoCard";

const minHeight = 370;

function SummarisedContent({ sudoData, twitterData, mastodonData }) {
  return (
    <div className="flex flex-col h-auto gap-4 overflow-y-auto">
      <TwitterContent twitterData={twitterData} />
      <MastodonContent mastodonData={mastodonData} />
      <SudoContent
        sudoData={sudoData}
        minHeight={minHeight}
        ContentHeader={ContentHeader}
      />
    </div>
  );
}

function TwitterContent({ twitterData }) {
  return (
    <Card
      sx={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "12px",
        minHeight: `${minHeight}px`,
        boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <CardContent>
        <ContentHeader
          string={twitterData.title ? twitterData.title : "Twitter Summary"}
        >
          <BsTwitter
            style={{ color: "#094183", fontSize: "24px", margin: "10px" }}
          />
        </ContentHeader>
        {/* Sudo card content */}
      </CardContent>
    </Card>
  );
}

function MastodonContent({ mastodonData }) {
  return (
    <Card
      sx={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "12px",
        minHeight: `${minHeight}px`,
        boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <CardContent>
        <ContentHeader
          string={mastodonData.title ? mastodonData.title : "Mastodon Summary"}
        >
          <BsMastodon
            style={{ color: "#094183", fontSize: "24px", margin: "10px" }}
          />
        </ContentHeader>
        {/* Sudo card content */}
      </CardContent>
    </Card>
  );
}

export default SummarisedContent;

function ContentHeader({ string, children }) {
  console.log(string);
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
