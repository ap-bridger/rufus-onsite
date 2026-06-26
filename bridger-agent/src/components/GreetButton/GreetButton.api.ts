import { gql } from "@apollo/client";

export const GREETINGS = gql(`
query Greetings {
    greetings
}
`);
