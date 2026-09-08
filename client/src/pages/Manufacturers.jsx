import React from "react";
import ContactDirectory from "./ContactDirectory";

export default function Manufacturers() {
  return (
    <ContactDirectory
      config={{
        title: "Manufacturers",
        singular: "Manufacturer",
        path: "/manufacturers",
        idKey: "ManufacturerId",
        listKey: "manufacturers",
        hint: "Brands and makers linked to assets in the register.",
        addHint: "Create a manufacturer with contact details.",
        editHint: "Update this manufacturer and contact details.",
      }}
    />
  );
}
