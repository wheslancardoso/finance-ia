import { createClient } from '@/utils/supabase/server'

export default async function Page() {
  // createClient agora é assíncrono e já lida com cookies internamente
  const supabase = await createClient()

  const { data: todos, error } = await supabase.from('todos').select()

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-500">Erro na Integração</h1>
        <pre className="bg-red-100 p-4 rounded">{JSON.stringify(error, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Teste Supabase ✅</h1>
      <p className="mb-4 text-gray-600">Conectado a: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
      
      <ul className="list-disc ml-6">
        {todos?.map((todo: any) => (
          <li key={todo.id} className="mb-1">{todo.name}</li>
        ))}
      </ul>
      
      {(!todos || todos.length === 0) && (
        <p className="mt-4 p-4 bg-blue-50 text-blue-700 rounded">
          Conexão estabelecida, mas nenhum dado foi encontrado na tabela 'todos'.
        </p>
      )}
    </div>
  )
}
