import type { Category } from '../App'
import { useEffect, useState } from 'react'

export default function IncomeForm() {
  const [ categories, setCategories ] = useState<Category[]>([]);
  const [ amount, setAmount ] = useState<number>(0);
  const [ categoryId, setCategoryId ] = useState<string | null>(null);
  const [ note, setNote ] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();

    (async() => {
      try {
        const response = await fetch(
          "https://finance.gootube.online/api/categories?type=Income",
          { signal: controller.signal }
        );

        if (!response.ok)
          throw new Error("Failed to fetch accounts");

        const data: {categories: Category[]} = await response.json();
        setCategories(data.categories);
      } catch(e) {
        if (e instanceof Error)
          console.log(e.message);
        setCategories([]);
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <form className="form-main">
      <div className="form-row">
        <label>Amount</label>
        <input
          type = "text"
          value = {amount.toLocaleString('vi-VN', {
            style: 'currency', currency: 'VND'
          })}
          onChange={(e) => setAmount(parseInt(e.target.value.replace(/[^\d]/g, "")))}
          onKeyDown={(e) => {if (e.code === 'Backspace') setAmount(Math.floor(amount / 10))}}
          placeholder='0'
        />
      </div>

      <div className="form-row">
        <label>Category</label>
        <select
          title="Category"
          value={categories.find(category => category.id === categoryId)?.name ?? "None"}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">None</option>
        </select>
      </div>

      <div className="form-row">
        <textarea 
          rows={3}
          value = {note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='Note...'
        />
      </div>
    </form>
  )
}