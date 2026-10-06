import React, { useState } from "react";
import { GiAustralia } from "react-icons/gi";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
const data = require("./sudoData.json");

const Sudo = ({ sudoData, setSudoData }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleOptionSelect = (option) => {
    setSudoData(option);
    handleClose();
  };

  return (
    <div>
      <Button
        variant="text"
        startIcon={<GiAustralia />}
        className="w-auto py-2 px-4"
        onClick={handleClick}
        style={{ color: "#094183" }}
      >
        SUDO
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

export default Sudo;
