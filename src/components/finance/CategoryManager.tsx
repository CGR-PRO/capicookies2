import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useData } from '../../store/DataProvider';
import { useToast } from '../../store/ToastProvider';
import { useConfirm } from '../ui/ConfirmDialog';
import { Button } from '../ui/Button';
import { CategoryDot, Segmented } from '../ui/Glass';
import { CATEGORY_COLORS } from '../../lib/defaults';
import type { Category, TxType } from '../../lib/types';

function ColorPicker({ value, onChange }: { value: string; onChange(c: string): void }) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Cor da categoria">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Cor ${c}`}
          className={`color-swatch${value === c ? ' is-active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

export function CategoryManager() {
  const { categories, saveCategory, deleteCategory, transactions } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [type, setType] = useState<TxType>('expense');
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const list = categories.filter((c) => c.type === type).sort((a, b) => a.name.localeCompare(b.name));

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await saveCategory({ name, color, type });
      setName('');
      toast.success('Categoria criada.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await saveCategory({ ...editing, name: editName, color: editColor });
      setEditing(null);
      toast.success('Categoria atualizada.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const remove = async (c: Category) => {
    const used = transactions.filter((t) => t.categoryId === c.id).length;
    const ok = await confirm({
      title: 'Excluir categoria?',
      message: used
        ? `“${c.name}” está em ${used} lançamento(s). Eles serão mantidos como “Sem categoria”.`
        : `A categoria “${c.name}” será removida.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCategory(c.id);
      toast.success('Categoria excluída.');
    } catch {
      toast.error('Não foi possível excluir.');
    }
  };

  return (
    <div className="category-manager">
      <Segmented
        label="Tipo de categoria"
        value={type}
        onChange={setType}
        options={[
          { value: 'expense', label: 'Despesas' },
          { value: 'income', label: 'Entradas' },
        ]}
      />
      <form className="category-add" onSubmit={add} noValidate>
        <label className="sr-only" htmlFor="new-cat">
          Nome da nova categoria
        </label>
        <input id="new-cat" className="input" placeholder="Nova categoria" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
        <ColorPicker value={color} onChange={setColor} />
        <Button type="submit" variant="primary" icon={<Plus size={16} />} disabled={!name.trim()}>
          Adicionar
        </Button>
      </form>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <ul className="category-list">
        {list.map((c) =>
          editing?.id === c.id ? (
            <li key={c.id} className="category-item is-editing">
              <input className="input" aria-label="Nome da categoria" value={editName} maxLength={40} onChange={(e) => setEditName(e.target.value)} autoFocus />
              <ColorPicker value={editColor} onChange={setEditColor} />
              <button className="icon-btn" onClick={saveEdit} aria-label="Salvar categoria">
                <Check size={16} />
              </button>
              <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Cancelar edição">
                <X size={16} />
              </button>
            </li>
          ) : (
            <li key={c.id} className="category-item">
              <CategoryDot color={c.color} />
              <span className="category-item__name">{c.name}</span>
              <button
                className="icon-btn"
                onClick={() => {
                  setEditing(c);
                  setEditName(c.name);
                  setEditColor(c.color);
                }}
                aria-label={`Editar ${c.name}`}
              >
                <Pencil size={16} />
              </button>
              <button className="icon-btn icon-btn--danger" onClick={() => remove(c)} aria-label={`Excluir ${c.name}`}>
                <Trash2 size={16} />
              </button>
            </li>
          ),
        )}
        {list.length === 0 && <li className="muted">Nenhuma categoria.</li>}
      </ul>
    </div>
  );
}
