/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { ValidationAcceptor } from "../../validator";
import * as AST from "../../../syntax-tree/ast";
import {
  Severity,
  tokenToRange,
  tokenToUri,
} from "../../../language-server/types";
import { PLICodes } from "..";
import { forEachNode } from "../../../syntax-tree/ast-iterator";

// function collectReturnStatements(
//   stmts: AST.Statement[] | undefined,
//   visited = new Set<object>(),
// ): AST.ReturnStatement[] {
//   if (!stmts) return [];

//   const found: AST.ReturnStatement[] = [];

//   for (const stmt of stmts) {
//     if (!stmt.value) continue;

//     // Avoid infinite recursion (cyclical references)
//     if (visited.has(stmt.value)) continue;
//     visited.add(stmt.value);

//     // If this is directly a RETURN
//     if (stmt.value.kind === AST.SyntaxKind.ReturnStatement) {
//       found.push(stmt.value as AST.ReturnStatement);
//     }

//     // Traverse *all* properties of this node dynamically
//     for (const key of Object.keys(stmt.value)) {
//       const prop = (stmt.value as any)[key];
//       if (!prop) continue;

//       // Case 1: a single nested Statement
//       if (prop._debugKind === "Statement") {
//         found.push(...collectReturnStatements([prop], visited));
//       }

//       // Case 2: an array of nested Statements
//       if (
//         Array.isArray(prop) &&
//         prop.every((p) => p?._debugKind === "Statement")
//       ) {
//         found.push(...collectReturnStatements(prop, visited));
//       }
//     }
//   }

//   return found;
// }

export function IBM2409I_invalid_return_with_returns_att(
  node: AST.ProcedureStatement,
  acceptor: ValidationAcceptor,
) {
  console.log('HALLO?');
  const hasReturnsAtt = node.options?.some(
    (att) => att.kind === AST.SyntaxKind.ReturnsOption,
  );
  if (!hasReturnsAtt) return;
  console.log('HAS RETURNS ATT');

  forEachNode(node, (n) => {
    console.log('FOR EACH NODES: ', n);
    if (n.kind !== AST.SyntaxKind.ReturnStatement) return;
    console.log('KIND IS RETURN!')
    if (n.expression) return;
    console.log('AND IT HAS EXP: ', n.expression);
    
    const token = n.returnToken
    if (!token) return;
    console.log('HAS TOKEN!');
  
    const errorRange = tokenToRange(token);
    const errorUri = tokenToUri(token);
    if (!errorRange || !errorUri) return;
  
    acceptor(Severity.E, PLICodes.Error.IBM2409I.message, {
      code: PLICodes.Error.IBM2409I.fullCode,
      range: errorRange,
      uri: errorUri,
    });
  })

}
