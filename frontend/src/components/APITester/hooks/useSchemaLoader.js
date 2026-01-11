import { useEffect, useState } from "react";
import { getSchema } from "../../../services/api";

export const useSchemaLoader = (connectionId, endpoint) => {
  const [schema, setSchema] = useState(null);
  const [selectedTable, setSelectedTable] = useState(
    endpoint?.table || endpoint?.tableName || ""
  );
  const [operation, setOperation] = useState(endpoint?.method || "GET");

  useEffect(() => {
    if (!connectionId) return;

    const load = async () => {
      const data = await getSchema(connectionId);
      setSchema(data);

      if (endpoint?.table || endpoint?.tableName) {
        setSelectedTable(endpoint.table || endpoint.tableName);
      } else {
        setSelectedTable(Object.keys(data)[0]);
      }

      if (endpoint?.method) {
        setOperation(endpoint.method);
      }
    };

    load();
  }, [connectionId, endpoint]);

  return { schema, selectedTable, setSelectedTable, operation, setOperation };
};
