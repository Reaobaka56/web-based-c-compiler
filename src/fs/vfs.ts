// Virtual file system persisted in IndexedDB (survives reloads).
import { get, set, del, keys } from 'idb-keyval'

const PREFIX = 'vfs:'

async function allPaths(): Promise<string[]> {
  const ks = await keys()
  return ks.filter((k): k is string => typeof k === 'string' && k.startsWith(PREFIX))
           .map((k) => k.slice(PREFIX.length))
}

export async function listFiles(): Promise<string[]> {
  return (await allPaths()).sort()
}

export async function readFile(path: string): Promise<string> {
  const v = await get(PREFIX + path)
  if (v === undefined) throw new Error(`No such file: ${path}`)
  return v as string
}

export async function writeFile(path: string, content: string): Promise<void> {
  await set(PREFIX + path, content)
}

export async function deleteFile(path: string): Promise<void> {
  await del(PREFIX + path)
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  const content = await readFile(oldPath)
  await writeFile(newPath, content)
  await deleteFile(oldPath)
}

/** Read every file into a plain map — used as compiler input. */
export async function readAll(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const p of await allPaths()) out[p] = await get(PREFIX + p) as string
  return out
}

export const LINKED_LIST_EXAMPLE = [
  '#include <iostream>',
  '#include <string>',
  '',
  'using namespace std;',
  '',
  'struct nodeType {',
  '    string info;',
  '    nodeType* link;',
  '};',
  '',
  'void insertAtHead(nodeType* &head, string value) {',
  '',
  '    nodeType* node1=new nodeType;',
  '    node1->info=value;',
  '    node1->link=head;',
  '    head=node1;',
  '}',
  '',
  'void deleteNode(nodeType* &head, string value) {',
  '',
  '    nodeType* current = head;',
  '    nodeType* previous = nullptr;',
  '',
  '    while(current != nullptr && current->info != value)',
  '    {',
  '        previous = current;',
  '        current = current->link;',
  '    }',
  '',
  '    if(current == nullptr)',
  '    {',
  '        cout << "Value not found.\\n";',
  '        return;',
  '    }',
  '',
  '    if(previous == nullptr)',
  '    {',
  '        head = current->link;',
  '    }',
  '    else',
  '    {',
  '        previous->link = current->link;',
  '    }',
  '',
  '    delete current;',
  '    cout << "Node deleted successfully.\\n";',
  '}',
  '',
  'int main() {',
  '    nodeType* head = nullptr;',
  '    int choice;',
  '    string value;',
  '',
  '    while(true)',
  '    {',
  '        cout << "\\n1. Insert\\n2. Delete\\n3. Display\\n4. Exit\\n";',
  '        cout << "Enter your choice: ";',
  '        if(!(cin >> choice))',
  '        {',
  '            cout << "\\nNo valid input. Exiting...\\n";',
  '            break;',
  '        }',
  '',
  '        if(choice == 1)',
  '        {',
  '            cout << "Enter value to insert: ";',
  '            cin >> value;',
  '            insertAtHead(head, value);',
  '        }',
  '        else if(choice == 2)',
  '        {',
  '            cout << "Enter value to delete: ";',
  '            cin >> value;',
  '            deleteNode(head, value);',
  '        }',
  '        else if(choice == 3)',
  '        {',
  '            if(head == nullptr)',
  '                cout << "List is empty.\\n";',
  '            nodeType* temp = head;',
  '            while(temp!=nullptr)',
  '            {',
  '                cout << temp->info << endl;',
  '                temp = temp->link;',
  '            }',
  '        }',
  '        else if(choice == 4)',
  '        {',
  '            cout << "Exiting...\\n";',
  '            break;',
  '        }',
  '        else',
  '        {',
  '            cout << "Invalid choice\\n";',
  '        }',
  '    }',
  '',
  '    while(head != nullptr)',
  '    {',
  '        nodeType* t = head;',
  '        head = head->link;',
  '        delete t;',
  '    }',
  '',
  '    return 0;',
  '}',
  ''
].join('\n')

const PREVIOUS_DEFAULT = [
  '#include <iostream>',
  '',
  'int main() {',
  '    std::cout << "Hello, World!" << std::endl;',
  '    return 0;',
  '}',
  ''
].join('\n')

const LEGACY_MAIN = [
  '#include <iostream>',
  '',
  'int main() {',
  '    std::cout << "Hello from CPP://Web!" << std::endl;',
  '    std::cout << "Toolchain check: edit me and press Run." << std::endl;',
  '    return 0;',
  '}',
  ''
].join('\n')

const DEFAULT_PROJECT: Record<string, string> = { '/main.cpp': LINKED_LIST_EXAMPLE }

const LEGACY_GUI_DEMO = [
  'extern "C" {',
  '    void gui_clear(int r, int g, int b);',
  '    void gui_rect(int x, int y, int w, int h, int r, int g, int b);',
  '    void gui_circle(int x, int y, int radius, int r, int g, int b);',
  '}',
  '',
  'int main() {',
  '    gui_clear(24, 30, 42);',
  '    gui_rect(80, 80, 220, 120, 61, 139, 253);',
  '    gui_circle(400, 240, 55, 224, 175, 104);',
  '    return 0;',
  '}',
  ''
].join('\n')

export async function ensureDefaultProject(): Promise<void> {
  const existing = await listFiles()
  if (existing.length === 0) {
    for (const [path, content] of Object.entries(DEFAULT_PROJECT)) await writeFile(path, content)
    return
  }

  if (existing.includes('/main.cpp')) {
    const main = await readFile('/main.cpp')
    if (main === PREVIOUS_DEFAULT || main === LEGACY_MAIN) {
      await writeFile('/main.cpp', LINKED_LIST_EXAMPLE)
    }
  }

  if (existing.includes('/gui_demo.cpp') && await readFile('/gui_demo.cpp') === LEGACY_GUI_DEMO) {
    await deleteFile('/gui_demo.cpp')
  }
}
