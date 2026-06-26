import { useLazyQuery } from "@apollo/client";
import { GREETINGS } from "./GreetButton.api";

export const GreetButton = () => {
  const [runQuery] = useLazyQuery(GREETINGS);
  const onClick = () => {
    runQuery({
      onCompleted: (result) => {
        alert(JSON.stringify(result));
      },
      onError: (error) => {
        alert(JSON.stringify(error));
      },
    });
  };
  return <button onClick={onClick}>Press to Greet</button>;
};
