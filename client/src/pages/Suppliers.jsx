import React from "react";
import ContactDirectory from "./ContactDirectory";

export default function Suppliers() {
  return (
    <ContactDirectory
      config={{
        title: "Suppliers",
        singular: "Supplier",
        path: "/suppliers",
        idKey: "SupplierId",
        listKey: "suppliers",
        hint: "Vendors that supply assets to the organization.",
        addHint: "Create a supplier with contact details.",
        editHint: "Update this supplier and contact details.",
      }}
    />
  );
}
