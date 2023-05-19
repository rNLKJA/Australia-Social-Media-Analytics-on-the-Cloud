import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Collapse,
  IconButton,
} from "@mui/material";
import { GiAustralia } from "react-icons/gi";
import { BiChevronDown, BiChevronUp } from "react-icons/bi";
import pako from "pako";
import Plot from "react-plotly.js";
import localForage from "localforage";

export default function SudoContent({ sudoData, minHeight, ContentHeader }) {
  const [content, setContent] = useState([]);
  const [plotData, setPlotData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const storedData = await localForage.getItem(sudoData.bar);

        if (storedData) {
          setPlotData(storedData);
          setIsLoading(false);
        } else {
          const response = await fetch(
            `/sudo_data/summary/${sudoData.bar}.json.gz`,
          );

          if (!response.ok) {
            throw new Error("Error fetching data");
          }

          const compressedData = await response.arrayBuffer();
          const decompressedData = pako.inflate(compressedData, {
            to: "string",
          });
          const data = JSON.parse(decompressedData);
          setPlotData(data);
          setIsLoading(false);
          await localForage.setItem(sudoData.bar, data);
        }

        const response2 = await fetch("/sudo_data/summary/sudo.json");
        const data2 = await response2.json();
        setContent(data2);
      } catch (error) {
        console.log(error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sudoData]);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const renderContent = () => {
    if (isExpanded) {
      return (
        <>
          {content.map((item) => {
            if (item.sudo === sudoData.map) {
              return (
                <React.Fragment key={item.sudo}>
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
        <ContentHeader string={sudoData.title}>
          <GiAustralia
            style={{ color: "#094183", fontSize: "24px", margin: "10px" }}
          />
        </ContentHeader>

        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <CircularProgress size={60} />
          </div>
        ) : plotData ? (
          <Plot
            data={plotData.data}
            layout={plotData.layout}
            useResizeHandler
            className="w-full h-auto"
          />
        ) : null}

        <IconButton
          onClick={handleExpand}
          className="ml-auto flex flex-row "
          size="small"
          color="primary"
        >
          <Typography className="px-2">SUDO Summary Report</Typography>
          {isExpanded ? <BiChevronUp /> : <BiChevronDown />}
        </IconButton>

        <Collapse in={isExpanded}>
          <div className="cursor-pointer">{renderContent()}</div>
        </Collapse>
      </CardContent>
    </Card>
  );
}
