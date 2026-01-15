import { useQuery } from "@tanstack/react-query"
import { getOperators } from "../../services/api";

export const useLoadOperators = ({connectionId}) => {
const result = useQuery({
  queryKey: ['operators', connectionId],
  queryFn: () => getOperators(connectionId),
  placeholderData: prev => prev, 
  enabled: !!connectionId,
})
return result;
}