import {
  ApolloClient,
  ApolloLink,
  createHttpLink,
  InMemoryCache,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(
          locations
        )}, Path: ${path?.toString()}`
      );
    });
  if (networkError) console.error(`[Network error]: ${networkError.message}`);
});

const links: ApolloLink[] = [errorLink];
links.push(createHttpLink({ uri: "/api/graphql" }));

export const apolloClient = new ApolloClient({
  link: ApolloLink.from(links),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
  },
  cache: new InMemoryCache({}),
});
