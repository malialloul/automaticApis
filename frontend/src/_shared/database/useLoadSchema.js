import { useQuery } from "@tanstack/react-query"
import { getSchema } from "../../services/api";

export const useLoadSchema = ({connectionId}) => {
const result = useQuery({
  queryKey: ['schema', connectionId],
  queryFn: () => getSchema(connectionId),
  placeholderData: prev => prev, 
  enabled: !!connectionId,
})
return result;
}