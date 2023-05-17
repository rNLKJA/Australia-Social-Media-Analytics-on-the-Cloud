import React, { useState } from "react";
import { SiOpenai } from "react-icons/si";
import Button from "@mui/material/Button";
import axios from "axios";
import "./gpt.css";

const GPTPopUp = () => {
  const [chatVisible, setChatVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");

  const handleCloseClick = () => {
    setChatVisible(false);
  };

  const handleClick = () => {
    setChatVisible(true);
  };

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleSendMessage = () => {
    if (inputValue.trim() === "") return;
    const newMessage = {
      role: "user",
      content: inputValue,
    };
    setMessages([...messages, newMessage]);
    setInputValue("");
    sendMessageToGPT(inputValue);
  };

  const sendMessageToGPT = async (message) => {
    try {
      const apiKey = process.env.REACT_APP_OPENAI_API_KEY; // Ensure the API key is correctly assigned
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          messages: [
            ...messages,
            { role: "user", content: message }, // Add the new user message
          ],
          max_tokens: 50,
          temperature: 0.7,
          n: 1,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );
      const completion = response.data.choices[0].text.trim();
      const newMessage = {
        role: "gpt",
        content: completion,
      };
      setMessages([...messages, newMessage]);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <Button
        variant="text"
        startIcon={<SiOpenai />}
        className="w-auto py-2 px-4"
        onClick={handleClick}
        style={{ color: "#094183" }}
      >
        ChatGPT
      </Button>
      {chatVisible && (
        <div className="popup-container">
          <div className="popup-content">
            <div className="popup-header">
              <h3>Chat with GPT-4</h3> // Updated header
              <button className="close-button" onClick={handleCloseClick}>
                &times;
              </button>
            </div>
            <div className="popup-messages">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message ${
                    message.role === "user" ? "user-message" : "gpt-message"
                  }`}
                >
                  {message.content}
                </div>
              ))}
            </div>
            <div className="popup-input">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
              />
              <button onClick={handleSendMessage}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GPTPopUp;
