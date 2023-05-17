import React, { useEffect, useState } from "react";
import { Card, CardContent, Typography, CircularProgress } from "@mui/material";
import { GiAustralia } from "react-icons/gi";

export default function SudoContent({ sudoData, minHeight, ContentHeader }) {
  const [content, setContent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/sudo_data/summary/sudo.json");
        const data = await response.json();
        // console.log(data);
        setContent(data);
        setIsLoading(false);
      } catch (error) {
        console.log(error);
      }
    };

    fetchData();
  }, [sudoData]);

  return (
    <Card className="bg-white rounded-8 p-4 h-full shadow-md flex flex-col">
      {isLoading && (
        <CircularProgress
          size={60}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        />
      )}
      <CardContent className="flex-grow">
        <ContentHeader string={sudoData.title}>
          <GiAustralia
            style={{ color: "#094183", fontSize: "24px", margin: "10px" }}
          />
        </ContentHeader>
        {content.map((item) => {
          if (item.sudo === sudoData.map) {
            return (
              <React.Fragment key={item.sudo}>
                {item.data.map((line, index) => (
                  <React.Fragment key={index}>
                    <Typography
                      className={`mt-${
                        index !== 0 ? 8 : 0
                      } whitespace-pre-line text-justify pl-8 pr-8`}
                    >
                      {line}
                    </Typography>
                    {index !== item.data.length - 1 && (
                      <hr className="my-2 border-none border-b-[1px] border-gray-300 ml-8 mr-8" />
                    )}
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          }
          return null;
        })}
      </CardContent>
    </Card>
  );
}
