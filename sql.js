export async function CreateUser(connection, id) {
    return new Promise(async (resolve, reject) => {
        connection.query("INSERT INTO users (id, families) VALUES (?, ?)", [id, jsonToString([])]).then((result) => {
            resolve(result);
        }
        ).catch((err) => {
            reject(err);
        })
    })
}
export function jsonToString(json) {
    return JSON.stringify(json);
}
export function stringToJson(string) {
    return JSON.parse(string);
}
