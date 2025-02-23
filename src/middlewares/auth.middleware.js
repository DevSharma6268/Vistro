import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import jwt from "jsonwebtoken"
import {User} from "../models/user.model.js"

export const verifyJWT = asyncHandler (async (req,_,next) =>{ // res
    try {
        const token = req.cookies?.accessToken || req.headers("Authorization")?.replace("Bearer ","")
    
        if(!token){
            throw new ApiError(401,"Unauthorized")
        }
    
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
    
        const user  = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!user){
            // discuss about frontend logout
            throw new ApiError(404,"User not found")
        }
    
        req.user =  user
        next()
    } catch (error) {
        throw new ApiError(401,"Unauthorized")    
    }

})