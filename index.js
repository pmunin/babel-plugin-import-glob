'use strict'

const path = require('path')
const glob = require('glob')
const capture = require('minimatch-capture')
const identifierfy = require('identifierfy')

/**
 * Returns cross-environment format of path (./path/to/file) - just replaces \ to /
 * @param {string} anyPath
 * @returns
 */
function crossEnvPath(anyPath){
  return anyPath.replace(new RegExp(path.sep.replace('\\','\\\\'),'g'), '/');
}


/**
 * 
 * @param {babel.PluginPass} state 
 * @returns {{trimFileExtensions:string[]}}
 */
function getPluginOptions(state)
{
  let res = state.opts || {};
  if(!res.trimFileExtensions)
    res.trimFileExtensions = ["js","jsx", "ts", "tsx"];
  return res;
}

/**
 *
 *
 * @param {string[]} files 
 * @param {string} pattern pattern
 * @param {string} cwd base directory
 * @param {babel.PluginPass} state base directory
 * @returns {{file:string, relative:string, name:string}[]}
 */
function generateChildModules (files, pattern, cwd, state) {
  return capture.match(files, pattern).map(match => {
    const file = match[0]
    const subpath = match[1]
    let relative = './' + crossEnvPath(path.relative(cwd, path.resolve(cwd, file)));

    const opts = getPluginOptions(state);

    for (const ext of opts.trimFileExtensions) {
      if(relative.endsWith('.'+ext))
        relative = relative.substr(0, relative.length-('.'+ext).length);
    }

    let res = {
      file,
      relative,
      name: memberify(subpath)
    }
    return res;
  })
}

function memberify (subpath) {
  const pieces = subpath.split('/')
  const prefixReservedWords = pieces.length === 1
  const ids = []
  for (let index = 0; index < pieces.length; index++) {
    const name = pieces[index]
    const id = identifierfy(name, {
      prefixReservedWords,
      prefixInvalidIdentifiers: index === 0
    })
    if (id === null) {
      return null
    }
    ids.push(id)
  }
  return ids.join('$')
}

function hasImportDefaultSpecifier (specifiers) {
  return specifiers.some(specifier => specifier.type === 'ImportDefaultSpecifier')
}

/**
 *
 *
 * @param {typeof babel.types} t
 * @param {*} localName
 * @param {*} src
 * @returns
 */
function makeImport (t, localName, src, isDefault) {
  return t.importDeclaration([
    isDefault
    ? t.importDefaultSpecifier(t.identifier(localName))
    : t.importNamespaceSpecifier(t.identifier(localName))
  ], t.stringLiteral(src))
}

/**
 *
 *
 * @param {typeof babel.types} t
 * @param {*} localName
 * @returns
 */
function freezeNamespaceObject (t, localName) {
  return t.expressionStatement(
    t.callExpression(
      t.memberExpression(t.identifier('Object'), t.identifier('freeze')),
      [t.identifier(localName)]
    )
  )
}

/**
 *
 *
 * @param {typeof babel.types} t
 * @param {string} localName
 * @param {*} members
 * @returns
 */
function makeNamespaceObject (t, localName, members) {
  
  const properties = members.map(member => t.objectProperty(
    t.stringLiteral(member.relative), t.identifier(`_${localName}_${member.name}`)
  ))
  return t.variableDeclaration(
    'const', [
      t.variableDeclarator(
        t.identifier(localName),
        t.objectExpression(properties)
      )
    ]
  )
}

const globPrefix = 'glob:'

/**
 *
 *
 * @param {import('@babel/core')} babelCore
 * @returns {babel.PluginObj}
 */
function importGlobPlugin(babelCore){
  const t = babelCore.types
  return {
    visitor: {
      ImportDeclaration (ast, state) {
        const specifiers = ast.node.specifiers
        const source = ast.node.source
        const error = message => ast.buildCodeFrameError(message)

        let pattern = source.value

        if (!glob.hasMagic(pattern)) {
          if (pattern.startsWith(globPrefix)) {
            throw error(`Missing glob pattern '${pattern}'`)
          }
          return
        }

        if (pattern.indexOf('*') < 0) return;

        if (pattern.startsWith(globPrefix)) {
          pattern = pattern.substr(globPrefix.length)
        }

        //if (hasImportDefaultSpecifier(specifiers)) {
        //  throw error('Cannot import the default member')
        //}

        if (!pattern.startsWith('.')) {
          throw error(`Glob pattern must be relative, was '${pattern}'`)
        }

        const currentDir = path.dirname(state.file.opts.filename)
        const files = glob.sync(pattern, { cwd: currentDir, strict: true })
        const modules = generateChildModules(files, pattern, currentDir, state);
        const unique = Object.create(null)

        //verifying name collisions of imported modules
        for (const childModule of modules) {
          if (childModule.name === null) {
            throw error(`Could not generate a valid identifier for '${childModule.file}'`)
          }
          if (unique[childModule.name]) {
            // hyphen conversion means foo-bar and fooBar will collide.
            throw error(`Found colliding members '${childModule.name}'`)
          }
          unique[childModule.name] = true
        }

        //console.warn(">>>>", specifiers.map(sp=>({sp, loc:sp.loc, local:sp.local})));

        if (specifiers.length > 0) {
          const replacement = []
          for (const specifier of specifiers) {
            const type = specifier.type
            const localName = specifier.local.name
            switch (type) {
              case 'ImportDefaultSpecifier':
              case 'ImportNamespaceSpecifier':
                  // Only ImportNamespaceSpecifier can be remaining, since
                  // importDefaultSpecifier has previously been rejected.
                  const isDefault = type==="ImportDefaultSpecifier";
                  for (const childModule of modules) {
                    
                    replacement.push(makeImport(t, `_${localName}_${childModule.name}`, childModule.relative, isDefault))
                  }
                  replacement.push(makeNamespaceObject(t, localName, modules, isDefault), freezeNamespaceObject(t, localName))
                break;
              default:
                throw new Error("Do not support import {...names...} from 'glob:...'")
                break;
            }
          }
          ast.replaceWithMultiple(replacement)
        } else {
          ast.replaceWithMultiple(modules.map(member => {
            return t.importDeclaration([], t.stringLiteral(member.relative))
          }))
        }
      }
    }
  }
}

module.exports = importGlobPlugin;
