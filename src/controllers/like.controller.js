import mongoose,{isValidObjectId} from "mongoose";
import { Like } from "../models/like.model";
import { ApiError} from "../utils/ApiError";
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req,res) => {
    const { videoId } = req.params
    //Todo: toggle like on video
})

const toggleCommentLike = asyncHandler(async (req,res) => {
    const { commentId } = req.params
    // todo:toggle like on comment
})


const toggleTweetLike = asyncHandler(async (req,res)=>{
    const { tweetId } = req.params
    //todo: toggle like on tweet
})

const getLikedVideos = asyncHandler(async (req,res)=>{
    //todo: get all liked videos
})

export {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos
}