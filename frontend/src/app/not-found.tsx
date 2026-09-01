import { ErrorDisplay } from "@/components/ErrorDisplay";

export default function NotFound() {
  return (
    <ErrorDisplay
      code="NOT_FOUND"
      message="The page you are looking for does not exist or has been moved."
    />
  );
}
