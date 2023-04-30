import React from "react";
import { FaSoundcloud } from "react-icons/fa";

export default function Welcome() {
  return (
    <div className="flex flex-col text-white text-center">
      <div className="flex flex-row items-center text-white text-center">
        <FaSoundcloud className="text-3xl mr-3" />
        <h1 className="text-4xl">Team 57 Frontend App</h1>
      </div>
    </div>
  );
}
