## Overview

This repository contains two servers:

- `bridger-agent`: A NextJS web server, complete with database and backend
- `langgraph-server`: A Python server running a Langgraph API

  There are instructions to run each of these in their respective directories

At the moment, there is a single end-to-end "greeting" functionality. This allows the user to
press a button, get an autoincrementing ID, and get a custom LLM-generated greeting for that ID.

![Screenshot 2024-11-15 at 10 11 11 AM](https://github.com/user-attachments/assets/38460d7d-1358-4475-98fb-64f48bbff40e)

How it works

- Visit the web server at `localhost:3000` and click the `Press to Greet` button
- This makes a GraphQL request to the backend web server
- The web server stores a `Greet` object in the database, and passes the ID of that object to the Python agent
- The Python agent calls an Anthropic model and asks it to generate a greeting, which is passed back up the stack to the user
