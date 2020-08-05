# babel-plugin-import-glob-simplified

Babel 7 plugin to enable importing modules using a [glob pattern][patterns].
Tested with Node.js 4 and above.

## Forked from [babel-plugin-import-glob][babel-plugin-import-glob]

What was changed?

- Babel 7 support (@babel/core)
- Fixed bug on windows, now tested on Win & Mac
- Import specific names NOT supported (`import {name1, name2} from 'glob:...'`)
- Both default import and namespace import supported:
  - Namespace import (`import * as modules from 'glob:...'`) compiles to:

      ```js
      import * as _modules_$path$to$file1 from './path/to/file1'
      import * as _modules_$path$to$file2 from './path/to/file1'
      const modules = {
        './path/to/file1': _modules_$path$to$file1,
        './path/to/file2': _modules_$path$to$file2
        };
      Object.freeze(modules);
      ```

  - Default imports (`import modules from 'glob:...'`) compiles to:

      ```js
      import _modules_$path$to$file1 from './path/to/file1'
      import _modules_$path$to$file2 from './path/to/file1'
      const modules = {
        './path/to/file1': _modules_$path$to$file1,
        './path/to/file2': _modules_$path$to$file2
        };
      Object.freeze(modules);
      ```

  - Plugin Options:

    ```json
    //.babelrc:
    {
      "plugins":[
        ["@babel/plugin-import-glob-simplified",{
          'trimFileExtensions':["js","jsx","ts","tsx"]
        }]
      ]
    }
    ```
    - trimFileExtensions - array of file extensions to trim from discovered files when put it to `pathToTrim` in `import ... from '{pathToTrim}'`

## Installation

Add to your `package.json/devDependencies`:
```json
"babel-plugin-import-glob-simplified": "https://github.com/pmunin/babel-plugin-import-glob-simplified.git"
```

Then register it in your `.babelrc` file, like:

```json
{
  "plugins": [
    ["@babel/plugin-import-glob-simplified", {
      "trimFileExtensions":["js","jsx", "ts", "tsx"] //optional
    }]
  ]
}
```

## TODO:

Tests need to be fixed accordingly to new design

[patterns]: https://www.npmjs.com/package/glob#glob-primer
[babel-plugin-import-glob]: https://www.npmjs.com/package/babel-plugin-import-glob
