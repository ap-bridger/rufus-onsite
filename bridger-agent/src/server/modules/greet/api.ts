import { prisma } from "@/lib/db";

export const greetings = async () => {
  const greet = await prisma.greet.create({});
  const response = await fetch("http://localhost:8000/agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username: greet.id.toLocaleString() }),
  });
  return await response.json();
};
