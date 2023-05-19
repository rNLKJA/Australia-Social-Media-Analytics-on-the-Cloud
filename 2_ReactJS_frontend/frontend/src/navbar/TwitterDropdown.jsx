import React, { useState } from "react";
import { BsTwitter } from "react-icons/bs";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
const data = require("./twitterData.json");

const Twitter = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedOption, setSelectedOption] = useState("");

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    handleClose();
  };

  return (
    <div>
      <Button
        variant="text"
        startIcon={<BsTwitter />}
        className="w-auto py-2 px-4"
        onClick={handleClick}
        style={{ color: "#094183" }}
      >
        Twitter
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        {data.map((item) => (
          <MenuItem
            key={item.title}
            onClick={() => handleOptionSelect(item)}
            disabled={!item.valid} // Disable the menu item if it is not valid
          >
            {item.title}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
};

export default Twitter;
