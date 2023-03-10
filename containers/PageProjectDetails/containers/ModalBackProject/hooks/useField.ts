import React from "react";

export function useField$Message() {
  const [text, setText] = React.useState("");
  const error = text.length > 1500 ? "Exceed character limit" : undefined;
  const parsed = !error ? text : undefined;
  return { text, setText, error, parsed };
}
