import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { realtimeDb } from '../firebase';
import { subscribeToItems } from '../realtimeItems';

export default function ItemDetailPage() {
  const { itemId } = useParams();
  const [items, setItems] = useState([]);

  useEffect(() => {
    return subscribeToItems(realtimeDb, setItems);
  }, []);

  const item = items.find((entry) => entry.itemId === itemId);

  return item ? <div>{item.name}</div> : <p>Loading…</p>;
}
