import { useEffect, useState } from 'react';

export function useStandalonePWA(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const detect = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setStandalone(detect());
    document.documentElement.classList.toggle('standalone', detect());

    const mq = window.matchMedia('(display-mode: standalone)');
    const onChange = () => {
      setStandalone(detect());
      document.documentElement.classList.toggle('standalone', detect());
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return standalone;
}
