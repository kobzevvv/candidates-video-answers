First of all, remember this is a GraphQL API not a REST API. The GraphQL docs give you access to everything and all of the things you mention can be done.
It is def. possible to create a new position via the API. Here is the specific playground that my CTO prepared to help build positions programmatically: https://codesandbox.io/p/sandbox/hireflix-position-creation-example-tzz6bz If you go to the src/app.js file you will find there the mutation that is being used. The position > save. This is what you need to create a new position. The playground is there precisely there to show you how
​image.png 
​It is possible to rename or update a position of course. You just have to use the same mutation above but passing the ID. That will update the position. 
To add an interview to a position is basically to "invite" a candidate to an interview which is explained in length on our API easy docs on Q28 check here. ​
image.png
​It is possible to update an interview to add a new question or remove... you just again use the same mutation I told you on the first point, but with the position ID and the new data.
And it is possible to delete a question. It is the same as above. Use the same query with the position ID but without the data you want to remove. 
I hope this clarifies, but yeah, basically everything you need is there. Again for the Position Save mutation which is the key one to solve all your problems, my CTO build this playground to help you understand it and implement it: https://codesandbox.io/p/sandbox/hireflix-position-creation-example-tzz6bz