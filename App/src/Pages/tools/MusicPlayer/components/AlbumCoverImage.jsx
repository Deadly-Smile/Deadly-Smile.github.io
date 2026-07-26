import { useEffect, useState } from "react";

export default function AlbumCoverImage({ blob, className, placeholder = "💿", placeholderClassName }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (!url) {
    return <div className={placeholderClassName}>{placeholder}</div>;
  }
  return <img src={url} alt="Album cover" className={className} />;
}
