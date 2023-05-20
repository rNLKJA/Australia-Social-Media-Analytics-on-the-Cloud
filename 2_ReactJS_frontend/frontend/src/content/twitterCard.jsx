import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Collapse,
  IconButton,
} from "@mui/material";
import { GiTwitter } from "react-icons/gi";
import { BiChevronDown, BiChevronUp } from "react-icons/bi";
import pako from "pako";
import Plot from "react-plotly.js";
import localForage from "localforage";
import { BsTwitter } from "react-icons/bs";

export default function TwitterContent({
  twitterData,
  minHeight,
  ContentHeader,
}) {
  const [content, setContent] = useState([]);
  const [plotData1, setPlotData1] = useState(null);
  const [plotData2, setPlotData2] = useState(null);
  const [plotData3, setPlotData3] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const storedData1 = await localForage.getItem(twitterData.plots[0]);
        const storedData2 = await localForage.getItem(twitterData.plots[1]);
        const storedData3 = await localForage.getItem(twitterData.plots[2]);

        if (storedData1 && storedData2 && storedData3) {
          setPlotData1(storedData1);
          setPlotData2(storedData2);
          setPlotData3(storedData3);
          setIsLoading(false);
        } else {
          const response1 = await fetch(
            `/twitter_data/summary/${twitterData.plots[0]}.json.gz`,
          );
          const response2 = await fetch(
            `/twitter_data/summary/${twitterData.plots[1]}.json.gz`,
          );
          const response3 = await fetch(
            `/twitter_data/summary/${twitterData.plots[2]}.json.gz`,
          );

          if (!response1.ok || !response2.ok || !response3.ok) {
            throw new Error("Error fetching data");
          }

          const compressedData1 = await response1.arrayBuffer();
          const compressedData2 = await response2.arrayBuffer();
          const compressedData3 = await response3.arrayBuffer();
          const decompressedData1 = pako.inflate(compressedData1, {
            to: "string",
          });
          const decompressedData2 = pako.inflate(compressedData2, {
            to: "string",
          });
          const decompressedData3 = pako.inflate(compressedData3, {
            to: "string",
          });
          const data1 = JSON.parse(decompressedData1);
          const data2 = JSON.parse(decompressedData2);
          const data3 = JSON.parse(decompressedData3);
          setPlotData1(data1);
          setPlotData2(data2);
          setPlotData3(data3);
          setIsLoading(false);
          await localForage.setItem(twitterData.plots[0], data1);
          await localForage.setItem(twitterData.plots[1], data2);
          await localForage.setItem(twitterData.plots[2], data3);
        }

        const response = await fetch("/twitter_data/summary/twitter.json");
        const data = await response.json();
        setContent(data);
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [twitterData]);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const renderContent = () => {
    if (isExpanded) {
      return (
        <>
          {content.map((item) => {
            if (item.twitter === twitterData.map) {
              return (
                <React.Fragment key={item.twitter}>
                  {item.data.slice(0, 3).map((line, index) => (
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
        </>
      );
    } else {
      return null;
    }
  };

  return (
    <Card
      className="bg-white rounded-8 p-4 h-full shadow-md flex flex-col"
      style={{ minHeight: minHeight }}
    >
      <CardContent className="flex-grow">
        <ContentHeader string={twitterData.title}>
          <BsTwitter
            style={{ color: "#094183", fontSize: "24px", margin: "10px" }}
          />
        </ContentHeader>

        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <CircularProgress size={60} />
          </div>
        ) : plotData1 && plotData2 && plotData3 ? (
          <>
            <Typography className="px-2">{`${twitterData.title} Overall Sentiment Score`}</Typography>
            <Plot
              data={plotData1.data}
              layout={plotData1.layout}
              useResizeHandler
              className="w-full h-auto"
            />
            <Typography className="px-2">{`${twitterData.title} Crime Mentioned Sentiment Score`}</Typography>
            <Plot
              data={plotData2.data}
              layout={plotData2.layout}
              useResizeHandler
              className="w-full h-auto"
            />
            <Typography className="px-2">{`${twitterData.title} Income Mentioned Sentiment Score`}</Typography>
            <Plot
              data={plotData3.data}
              layout={plotData3.layout}
              useResizeHandler
              className="w-full h-auto"
            />
          </>
        ) : null}

        <IconButton
          onClick={handleExpand}
          className="ml-auto flex flex-row "
          size="small"
          color="primary"
        >
          <Typography className="px-2">Twitter Summary Report</Typography>
          {isExpanded ? <BiChevronUp /> : <BiChevronDown />}
        </IconButton>

        <Collapse in={isExpanded}>
          <div className="cursor-pointer">{renderContent()}</div>
        </Collapse>
      </CardContent>
    </Card>
  );
}
