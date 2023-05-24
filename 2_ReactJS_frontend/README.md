# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

In the project directory, you can run:
```bash
# to active the react app, use npm start
# by default react application will on port 3000
npm start

# building production package
npm build

# serve statistical website
npm -i serve  
serve -s build
```

If want to serve a static website, Node.js version 14 is mandatory otherwise there will be an issus with port string parsing.

To avoid this issue, you could also use `httpserve` which brings you lower level control for stattical web application.
