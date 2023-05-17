import React, { useState } from "react";
import { BsTwitter } from "react-icons/bs";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

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
        <MenuItem onClick={() => handleOptionSelect("option1")}>
          Option 1
        </MenuItem>
        <MenuItem onClick={() => handleOptionSelect("option2")}>
          Option 2
        </MenuItem>
        {/* Add more menu items for different options */}
      </Menu>
    </div>
  );
};

export default Twitter;
