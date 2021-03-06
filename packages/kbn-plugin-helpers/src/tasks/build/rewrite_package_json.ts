/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import Through2Map from 'through2-map';
import File from 'vinyl';
import { gitInfo } from './git_info';

export function rewritePackageJson(
  buildSource: string,
  buildVersion: string,
  kibanaVersion: string
) {
  return Through2Map.obj(function (file: File) {
    if (file.basename === 'package.json' && file.dirname === buildSource) {
      const pkg = JSON.parse(file.contents!.toString('utf8'));

      // rewrite the target kibana version while the
      // file is on it's way to the archive
      if (!pkg.kibana) pkg.kibana = {};
      pkg.kibana.version = kibanaVersion;
      pkg.version = buildVersion;

      // append build info
      pkg.build = {
        git: gitInfo(buildSource),
        date: new Date().toString(),
      };

      // remove development properties from the package file
      delete pkg.scripts;
      delete pkg.devDependencies;

      file.contents = Buffer.from(JSON.stringify(pkg, null, 2));
    }

    return file;
  });
}
