## Overview

This server initially contains a single API, `greetings`. Each request to this API stores a new
`Greet` object in the database and returns the ID of that object.

## Installation

`npm install`

## Run Migrations

`npm run prisma:migrate:dev`

## Running The Server

`npm run dev`

Visit `http://localhost:3000` in the browser

## Frontend

This project uses the NextJS app router. For simplicity, the root page, `src/app/page.tsx` is a child
component, using `"use client"`

## API

This project uses GraphQL Yoga, a simple GQL server. You can view an interative UI at:

`http://localhost:3000/api/graphql`

A sample query that works is:

```
query Hello {
  greetings
}
```

The GraphQL client used is Apollo Client.
The `src/components/GreetButton` component has an example of calling the `greetings` query
and handling the results.

## Database

This project uses Prisma as the ORM, with sqlite as the backend.

The schema file is located at `prisma/schema.prisma`

Common commands

- View a UI over the database: `npm run prisma:studio`
- Run migrations: `npm run prisma:migrate:dev`
- Format the schema file: `npm run prisma:format`
